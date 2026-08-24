import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { getClientOverview } from "@/lib/client-portal-queries";
import { formatMoney } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function PortalHomePage() {
  const session = await getClientSession();
  if (!session) redirect("/portal/login");
  const ov = await getClientOverview(session);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Welcome, {session.clientName}</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Balance</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatMoney(ov.outstandingBalance, "IDR")}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Unpaid Invoices</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{ov.unpaidCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Active Projects</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{ov.activeProjectCount}</div></CardContent>
        </Card>
      </div>
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent Invoices</h2>
          <Link href="/portal/invoices" className="text-sm text-muted-foreground hover:text-foreground">View all</Link>
        </div>
        {ov.recentInvoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invoices yet.</p>
        ) : (
          <div className="border rounded-lg divide-y">
            {ov.recentInvoices.map((i) => (
              <Link key={i.id} href={`/invoices/${i.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50">
                <div>
                  <div className="font-medium">{i.invoiceNumber}</div>
                  <div className="text-xs text-muted-foreground">{i.projectTitle}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{formatMoney(i.amount, i.currency)}</span>
                  <Badge variant={i.status === "paid" ? "default" : "secondary"}>{i.status}</Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
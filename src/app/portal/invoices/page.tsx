import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { getClientInvoices } from "@/lib/client-portal-queries";
import { formatMoney } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format } from "date-fns";

export default async function PortalInvoicesPage() {
  const session = await getClientSession();
  if (!session) redirect("/portal/login");
  const invoices = await getClientInvoices(session);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Invoices</h1>
      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">You have no invoices.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Invoice</th>
                <th className="px-4 py-2 font-medium">Project</th>
                <th className="px-4 py-2 font-medium">Amount</th>
                <th className="px-4 py-2 font-medium">Due</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-3 font-medium">{i.invoiceNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground">{i.projectTitle}</td>
                  <td className="px-4 py-3">{formatMoney(i.amount, i.currency)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{i.dueDate ? format(i.dueDate, "dd MMM yyyy") : "—"}</td>
                  <td className="px-4 py-3"><Badge variant={i.status === "paid" ? "default" : "secondary"}>{i.status}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="outline" size="sm"><Link href={`/invoices/${i.id}`}>View</Link></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
import { prisma } from "@/lib/prisma";
import { InvoicesClient } from "./invoices-client";

import { GlobalInvoicePoller } from "@/components/global-invoice-poller";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const [invoicesRaw, unpaidCount] = await Promise.all([
    prisma.invoice.findMany({
      include: {
        project: {
          include: { client: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invoice.count({ where: { status: "UNPAID" } }),
  ]);

  // Serialize records
  const invoices = invoicesRaw.map((inv) => ({
    ...inv,
    amount: inv.amount.toString(),
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
    dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
    paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
    project: {
      ...inv.project,
      totalPrice: inv.project.totalPrice.toString(),
      dpAmount: inv.project.dpAmount?.toString() || null,
      taxRate: inv.project.taxRate?.toString() || null,
      createdAt: inv.project.createdAt.toISOString(),
      updatedAt: inv.project.updatedAt.toISOString(),
      client: {
        ...inv.project.client,
        createdAt: inv.project.client.createdAt.toISOString(),
        updatedAt: inv.project.client.updatedAt.toISOString(),
      },
    },
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground mt-2">
            Manage internal invoices and track payment statuses.
          </p>
        </div>
      </div>

      <GlobalInvoicePoller currentUnpaidCount={unpaidCount} />
      <InvoicesClient initialInvoices={invoices} />
    </div>
  );
}

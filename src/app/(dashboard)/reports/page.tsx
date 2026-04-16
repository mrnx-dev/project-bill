import { prisma } from "@/lib/prisma";
import { ReportsClient } from "./reports-client";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  // Fetch all paid invoices for revenue data
  const invoicesRaw = await prisma.invoice.findMany({
    include: {
      project: {
        include: { client: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch all clients for the breakdown
  const clientsRaw = await prisma.client.findMany({
    where: { isArchived: false },
    orderBy: { name: "asc" },
  });

  // Serialize for client component
  const invoices = invoicesRaw.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    amount: inv.amount.toNumber(),
    status: inv.status,
    type: inv.type,
    notes: inv.notes,
    dueDate: inv.dueDate?.toISOString() || null,
    paidAt: inv.paidAt?.toISOString() || null,
    createdAt: inv.createdAt.toISOString(),
    clientName: inv.project?.client?.name || "Unknown",
    clientId: inv.project?.clientId || "",
    projectName: inv.project?.title || "Unknown",
    projectId: inv.projectId,
  }));

  const clients = clientsRaw.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-2">
            Revenue analytics, invoice aging, and export tools.
          </p>
        </div>
      </div>

      <ReportsClient invoices={invoices} clients={clients} />
    </div>
  );
}

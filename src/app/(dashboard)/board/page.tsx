import { prisma } from "@/lib/prisma";
import { DashboardClient as BoardClient } from "./board-client"; // Renamed on import for now to avoid refactoring the component itself

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const projectsRaw = await prisma.project.findMany({
    include: { client: true, invoices: true, items: true },
    orderBy: { createdAt: "desc" },
  });

  // Serialize records
  const projects = projectsRaw.map((p) => ({
    ...p,
    totalPrice: p.totalPrice.toString(),
    dpAmount: p.dpAmount?.toString() || null,
    deadline: p.deadline?.toISOString() || null,
    currency: p.currency,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    client: {
      ...p.client,
      createdAt: p.client.createdAt.toISOString(),
      updatedAt: p.client.updatedAt.toISOString(),
    },
    invoices: p.invoices.map((i: any) => ({
      ...i,
      amount: i.amount.toString(),
      dueDate: i.dueDate?.toISOString() || null,
      paidAt: i.paidAt?.toISOString() || null,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    })),
    items: p.items.map((i: any) => ({
      id: i.id,
      description: i.description,
      price: i.price.toString(),
    })),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Task Board</h1>
          <p className="text-muted-foreground mt-2">
            Manage project lifecycles using the Kanban board.
          </p>
        </div>
      </div>

      <BoardClient initialProjects={projects} />
    </div>
  );
}

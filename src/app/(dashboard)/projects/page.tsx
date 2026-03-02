import { prisma } from "@/lib/prisma";
import { ProjectsClient } from "./projects-client";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projectsRaw = await prisma.project.findMany({
    include: { client: true, invoices: true, items: true },
    orderBy: { createdAt: "desc" },
  });

  const clientsRaw = await prisma.client.findMany({
    orderBy: { name: "asc" },
  });

  // Serialize records
  const projects = projectsRaw.map((p) => ({
    ...p,
    totalPrice: p.totalPrice.toString(),
    dpAmount: p.dpAmount?.toString() || null,
    deadline: p.deadline?.toISOString() || null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    client: {
      ...p.client,
      createdAt: p.client.createdAt.toISOString(),
      updatedAt: p.client.updatedAt.toISOString(),
    },
    invoices: p.invoices.map((inv: any) => ({
      ...inv,
      amount: inv.amount.toString(),
      dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
      paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
      createdAt: inv.createdAt.toISOString(),
      updatedAt: inv.updatedAt.toISOString(),
    })),
    items:
      (p as any).items?.map((i: any) => ({
        id: i.id,
        description: i.description,
        price: i.price.toString(),
      })) || [],
  }));

  const clients = clientsRaw.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-2">
            Create and track projects.
          </p>
        </div>
      </div>

      <ProjectsClient initialProjects={projects} clients={clients} />
    </div>
  );
}

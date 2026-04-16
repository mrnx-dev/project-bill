// AI Tool Definitions — query business data
import { prisma } from "@/lib/prisma";

export async function queryInvoices(args: { status?: string; limit?: number; clientId?: string }) {
  const where: Record<string, unknown> = {};
  if (args.status) where.status = args.status;
  if (args.clientId) where.project = { clientId: args.clientId };

  const invoices = await prisma.invoice.findMany({
    where,
    take: args.limit ?? 10,
    orderBy: { createdAt: "desc" },
    include: { project: { select: { title: true, client: { select: { name: true } } } } },
  });

  return {
    success: true,
    data: invoices.map((inv) => ({
      id: inv.id,
      number: inv.invoiceNumber,
      amount: Number(inv.amount),
      status: inv.status,
      projectName: inv.project?.title ?? "",
      clientName: inv.project?.client?.name ?? "",
    })),
  };
}

export async function queryProjects(args: { status?: string; limit?: number; clientId?: string }) {
  const where: Record<string, unknown> = {};
  if (args.status) where.status = args.status;
  if (args.clientId) where.clientId = args.clientId;

  const projects = await prisma.project.findMany({
    where,
    take: args.limit ?? 10,
    orderBy: { createdAt: "desc" },
    include: { client: { select: { name: true } }, items: true },
  });

  return {
    success: true,
    data: projects.map((p: any) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      totalPrice: Number(p.totalPrice),
      clientName: p.client?.name ?? "",
      deadline: p.deadline,
      items: p.items.map((item: any) => ({ description: item.description, price: Number(item.price) })),
    })),
  };
}

export async function analyzeCashflow() {
  const paid = await prisma.invoice.aggregate({
    _sum: { amount: true },
    _count: true,
    where: { status: "paid" },
  });

  const unpaid = await prisma.invoice.aggregate({
    _sum: { amount: true },
    _count: true,
    where: { status: "unpaid" },
  });

  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const lastMonthPaid = await prisma.invoice.aggregate({
    _sum: { amount: true },
    where: { status: "paid", createdAt: { gte: lastMonth } },
  });

  const trend = Number(paid._sum.amount ?? 0) >= Number(lastMonthPaid._sum.amount ?? 0);
  const total = Number(paid._sum.amount ?? 0) + Number(unpaid._sum.amount ?? 0);

  return {
    success: true,
    data: {
      totalPaid: Number(paid._sum.amount ?? 0),
      totalPending: Number(unpaid._sum.amount ?? 0),
      paidCount: paid._count,
      unpaidCount: unpaid._count,
      trend: trend ? "up" : "down",
      collectionRate: total > 0 ? Math.round((Number(paid._sum.amount ?? 0) / total) * 100) : 0,
    },
  };
}

export async function getClientDetails(args: { name: string }) {
  const clients = await prisma.client.findMany({
    where: { name: { contains: args.name, mode: "insensitive" } },
    take: 5,
    include: {
      _count: { select: { projects: true } },
      projects: { include: { invoices: true } },
    },
  });

  return {
    success: true,
    data: clients.map((c: any) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      projectCount: c._count.projects,
      totalInvoices: c.projects.reduce((s: number, p: any) => s + p.invoices.length, 0),
    })),
  };
}

// Tool registry
export const AI_TOOL_DEFS = [
  {
    type: "function" as const,
    function: {
      name: "query_invoices",
      description: "Search and filter invoices by status or client",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["paid", "unpaid"] },
          limit: { type: "number" },
          clientId: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "query_projects",
      description: "Search and filter projects by status or client",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["to_do", "in_progress", "done"] },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "analyze_cashflow",
      description: "Get financial analysis: total paid, pending, trends, collection rate",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_client_details",
      description: "Get details about a client including projects and invoices",
      parameters: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    },
  },
];

export async function executeTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "query_invoices": return queryInvoices(args as { status?: string; limit?: number; clientId?: string });
    case "query_projects": return queryProjects(args as { status?: string; limit?: number });
    case "analyze_cashflow": return analyzeCashflow();
    case "get_client_details": return getClientDetails(args as { name: string });
    default: return { success: false, error: `Unknown tool: ${name}` };
  }
}

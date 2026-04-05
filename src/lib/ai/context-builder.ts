import { prisma } from "@/lib/prisma";
import { format, differenceInDays } from "date-fns";
import type {
  BusinessContext,
  InvoiceSummary,
  DeadlineSummary,
  ClientSummary,
  StatsSummary,
} from "./types";

export async function buildBusinessContext(): Promise<BusinessContext> {
  const settings = await prisma.settings.findUnique({
    where: { id: "global" },
    select: { companyName: true, companyEmail: true, companyLogoUrl: true },
  });

  const clientCount = await prisma.client.count({ where: { isArchived: false } });
  const activeProjectCount = await prisma.project.count({ where: { status: { not: "done" } } });
  const doneProjectCount = await prisma.project.count({ where: { status: "done" } });

  const paidAggregate = await prisma.invoice.aggregate({
    _sum: { amount: true },
    _count: true,
    where: { status: "paid" },
  });

  const unpaidAggregate = await prisma.invoice.aggregate({
    _sum: { amount: true },
    _count: true,
    where: { status: "unpaid" },
  });

  const unpaidCount = await prisma.invoice.count({ where: { status: "unpaid" } });

  const now = new Date();
  const overdueCount = await prisma.invoice.count({
    where: { status: "unpaid", dueDate: { lt: now } },
  });

  const recentInvoicesRaw = await prisma.invoice.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { project: { include: { client: true } } },
  });

  const upcomingDeadlinesRaw = await prisma.project.findMany({
    where: { status: { not: "done" }, deadline: { not: null } },
    orderBy: { deadline: "asc" },
    take: 5,
    include: { client: true },
  });

  // Top clients — aggregate all client paid/pending
  const clients = await prisma.client.findMany({
    where: { isArchived: false },
    include: {
      _count: { select: { projects: true } },
      projects: {
        include: { invoices: true },
      },
    },
  });

  const topClients: ClientSummary[] = clients
    .map((c) => {
      let totalPaid = 0;
      let totalPending = 0;
      let activeProjectCount = 0;

      for (const p of c.projects) {
        for (const inv of p.invoices) {
          if (inv.status === "paid") totalPaid += Number(inv.amount);
          else totalPending += Number(inv.amount);
        }
        if (p.status !== "done") activeProjectCount++;
      }

      return {
        name: c.name,
        email: c.email ?? "",
        totalPaid,
        totalPending,
        projectCount: c._count.projects,
        activeProjectCount,
      };
    })
    .sort((a, b) => b.totalPaid - a.totalPaid)
    .slice(0, 5);

  const stats: StatsSummary = {
    totalClients: clientCount,
    activeProjects: activeProjectCount,
    doneProjects: doneProjectCount,
    totalPaid: Number(paidAggregate._sum.amount ?? 0),
    totalPending: Number(unpaidAggregate._sum.amount ?? 0),
    unpaidInvoices: unpaidCount,
    overdueInvoices: overdueCount,
  };

  const recentInvoices: InvoiceSummary[] = recentInvoicesRaw.map((inv) => ({
    id: inv.id,
    number: inv.invoiceNumber,
    amount: Number(inv.amount),
    status: inv.status,
    dueDate: inv.dueDate,
    projectName: inv.project.title,
    clientName: inv.project.client.name,
  }));

  const upcomingDeadlines: DeadlineSummary[] = upcomingDeadlinesRaw.map((p) => {
    const deadline = p.deadline!;
    return {
      title: p.title,
      deadline,
      clientName: p.client.name,
      daysRemaining: differenceInDays(deadline, now),
    };
  });

  return {
    companyInfo: {
      name: settings?.companyName ?? "ProjectBill",
      email: settings?.companyEmail ?? "",
      logoUrl: settings?.companyLogoUrl,
    },
    stats,
    recentInvoices,
    upcomingDeadlines,
    topClients,
  };
}

export function formatContextForPrompt(ctx: BusinessContext): string {
  const lines: string[] = [];

  lines.push(`# Company: ${ctx.companyInfo.name}`);
  lines.push(`Contact: ${ctx.companyInfo.email || "Not set"}`);
  lines.push("");

  const s = ctx.stats;
  lines.push("## Financial Overview");
  lines.push(`- Clients: ${s.totalClients} (${s.activeProjects} active)`);
  lines.push(`- Revenue Paid: Rp ${s.totalPaid.toLocaleString("id-ID")}`);
  lines.push(`- Revenue Pending: Rp ${s.totalPending.toLocaleString("id-ID")}`);
  lines.push(`- Unpaid Invoices: ${s.unpaidInvoices} (${s.overdueInvoices} overdue)`);
  lines.push("");

  if (ctx.recentInvoices.length > 0) {
    lines.push("## Recent Invoices");
    for (const inv of ctx.recentInvoices) {
      const status = inv.status === "paid" ? "✅ Paid" : "⏳ Unpaid";
      lines.push(
        `- ${inv.number}: Rp ${inv.amount.toLocaleString("id-ID")} — ${inv.projectName} (${inv.clientName}) ${status}`,
      );
    }
    lines.push("");
  }

  if (ctx.upcomingDeadlines.length > 0) {
    lines.push("## Upcoming Deadlines");
    for (const d of ctx.upcomingDeadlines) {
      const dayStr = d.daysRemaining > 0 ? `${d.daysRemaining} days left` : d.daysRemaining === 0 ? "TODAY" : `${Math.abs(d.daysRemaining)} days OVERDUE`;
      lines.push(`- ${d.title} for ${d.clientName} — ${dayStr}`);
    }
    lines.push("");
  }

  if (ctx.topClients.length > 0) {
    lines.push("## Top Clients by Revenue");
    for (const c of ctx.topClients) {
      lines.push(
        `- ${c.name}: Rp ${c.totalPaid.toLocaleString("id-ID")} earned, Rp ${c.totalPending.toLocaleString("id-ID")} pending (${c.projectCount} projects, ${c.activeProjectCount} active)`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

import { toContractDocumentProps, type ProjectWithRelations } from "./contract-document-mapper";
import type { ContractDocumentProps } from "@/components/contract-document";

export type ClientSession = { clientId: string; organizationId: string; clientName: string };

const TERMINAL_PROJECT_STATUSES = new Set(["done", "completed", "cancelled"]);

/** Normalize a Prisma Decimal (object with toString()) or string to a JS number. */
function num(v: { toString(): string } | string | null | undefined): number {
  if (v == null) return 0;
  return Number(typeof v === "string" ? v : v.toString());
}

/** Invoices for the authenticated client, newest first. */
export async function getClientInvoices(session: ClientSession) {
  const { prisma } = await import("./prisma");
  const rows = await prisma.invoice.findMany({
    where: { organizationId: session.organizationId, project: { clientId: session.clientId } },
    include: { project: { select: { title: true, currency: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((i) => ({
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    projectTitle: i.project.title,
    type: i.type,
    amount: num(i.amount),
    status: i.status,
    dueDate: i.dueDate,
    currency: i.project.currency,
    createdAt: i.createdAt,
  }));
}

/** Projects for the authenticated client with computed progress + paid amount. */
export async function getClientProjects(session: ClientSession) {
  const { prisma } = await import("./prisma");
  const rows = await prisma.project.findMany({
    where: { clientId: session.clientId, organizationId: session.organizationId },
    include: { milestones: { include: { invoice: true } }, invoices: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((p) => {
    const total = num(p.totalPrice);
    const paidAmount = p.invoices.reduce(
      (s, i) => (i.status === "paid" ? s + num(i.amount) : s),
      0,
    );
    let progressPct: number;
    if (p.billingMode === "MILESTONE" && p.milestones.length > 0) {
      const paidPct = p.milestones.reduce(
        (s, m) => (m.invoice?.status === "paid" ? s + num(m.percentage) : s),
        0,
      );
      progressPct = Math.min(100, Math.round(paidPct));
    } else {
      progressPct = total > 0 ? Math.min(100, Math.round((paidAmount / total) * 100)) : 0;
    }
    return {
      id: p.id,
      title: p.title,
      status: p.status,
      currency: p.currency,
      totalPrice: total,
      paidAmount,
      progressPct,
      hasTerms: !!p.terms,
    };
  });
}

/** Overview: outstanding balance, unpaid count, active projects, recent invoices. */
export async function getClientOverview(session: ClientSession) {
  const [invoices, projects] = await Promise.all([
    getClientInvoices(session),
    getClientProjects(session),
  ]);
  const unpaid = invoices.filter((i) => i.status === "unpaid");
  const outstandingBalance = unpaid.reduce((s, i) => s + i.amount, 0);
  const activeProjectCount = projects.filter(
    (p) => !TERMINAL_PROJECT_STATUSES.has(p.status.toLowerCase()),
  ).length;
  return {
    outstandingBalance,
    unpaidCount: unpaid.length,
    activeProjectCount,
    recentInvoices: invoices.slice(0, 5),
  };
}

/** Scoped SOW for a project (null if not the client's or no terms). */
export async function getClientProjectSow(
  session: ClientSession,
  projectId: string,
): Promise<ContractDocumentProps | null> {
  const { prisma } = await import("./prisma");
  const p = await prisma.project.findUnique({
    where: { id: projectId, clientId: session.clientId, organizationId: session.organizationId },
    include: {
      items: { select: { description: true, quantity: true, rate: true, price: true } },
      milestones: {
        orderBy: { order: "asc" },
        select: { name: true, percentage: true, amount: true, dueDate: true },
      },
      client: { select: { name: true, email: true, phone: true } },
    },
  });
  if (!p || !p.terms) return null;

  const settings = await prisma.settings.findFirst({
    where: { organizationId: session.organizationId },
    select: {
      companyName: true,
      companyAddress: true,
      companyEmail: true,
      companyWhatsApp: true,
    },
  });

  return toContractDocumentProps({
    project: p as ProjectWithRelations, // terms guard above proves terms is non-null
    provider: settings ?? {
      companyName: null,
      companyAddress: null,
      companyEmail: null,
      companyWhatsApp: null,
    },
  });
}
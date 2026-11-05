import type { ContractDocumentProps } from "@/components/contract-document";
import { renderContractTemplate } from "@/lib/contract-template";

// The ONLY place Decimal/Date become number/string. Never pass a raw Decimal or Date into
// <ContractDocument>: it prints NaN / [object Object] on an A4 contract.
//
// Every field is named explicitly. Do NOT `const { organizationId, clientId, ...rest } = project`
// and return `rest` — that is the pattern that silently leaks the next column somebody adds.

export type ProjectWithRelations = {
  title: string;
  contractNumber: string | null;
  createdAt: Date;
  deadline: Date | null;
  totalPrice: unknown; // Prisma Decimal
  currency: string;
  taxName: string | null;
  taxRate: unknown; // Prisma Decimal
  dpAmount: unknown; // Prisma Decimal
  billingMode: string;
  language: string;
  terms: string;
  termsAcceptedAt: Date | null;
  termsAcceptedUserAgent: string | null;
  termsAcceptedSessionId: string | null;
  items: { description: string; quantity: unknown; rate: unknown; price: unknown }[];
  milestones: { name: string; percentage: unknown; amount: unknown; dueDate: Date | null }[];
  client: { name: string; email: string | null; phone: string | null };
};

export type ProviderSettings = {
  companyName: string | null;
  companyAddress: string | null;
  companyEmail: string | null;
  companyWhatsApp: string | null;
};

export function toContractDocumentProps(input: {
  project: ProjectWithRelations;
  provider: ProviderSettings;
}): ContractDocumentProps {
  const { project, provider } = input;
  const props: ContractDocumentProps = {
    language: project.language,
    contractNumber: project.contractNumber,
    title: project.title,
    createdAt: project.createdAt.toISOString(),
    provider: {
      name: provider.companyName ?? "",
      address: provider.companyAddress,
      email: provider.companyEmail,
      whatsapp: provider.companyWhatsApp,
    },
    client: {
      name: project.client.name,
      email: project.client.email,
      phone: project.client.phone,
    },
    items: project.items.map((item) => ({
      description: item.description,
      quantity: item.quantity === null ? null : Number(item.quantity),
      rate: item.rate === null ? null : Number(item.rate),
      price: Number(item.price),
    })),
    totalPrice: Number(project.totalPrice),
    currency: project.currency,
    taxName: project.taxName,
    taxRate: project.taxRate === null ? null : Number(project.taxRate),
    dpAmount: project.dpAmount === null ? null : Number(project.dpAmount),
    billingMode: project.billingMode,
    milestones: project.milestones.map((m) => ({
      name: m.name,
      percentage: Number(m.percentage),
      amount: Number(m.amount),
      dueDate: m.dueDate ? m.dueDate.toISOString() : null,
    })),
    deadline: project.deadline ? project.deadline.toISOString() : null,
    terms: project.terms,
    termsAcceptedAt: project.termsAcceptedAt ? project.termsAcceptedAt.toISOString() : null,
    termsAcceptedUserAgent: project.termsAcceptedUserAgent,
    termsAcceptedSessionId: project.termsAcceptedSessionId,
  };
  // The body is written with {{placeholders}} in the database; expand them once here so
  // every call site (print page, public payload, client portal) receives rendered text.
  return { ...props, terms: renderContractTemplate(project.terms, props) };
}

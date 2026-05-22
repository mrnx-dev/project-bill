"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function checkInvoiceStatus(invoiceId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId, organizationId: session.user.activeOrganizationId! },
    select: { status: true },
  });
  if (!invoice) throw new Error("Invoice not found");
  return invoice;
}
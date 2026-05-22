"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function countUnpaidInvoices() {
  const session = await auth();
  if (!session?.user?.id) return { count: 0 };
  const count = await prisma.invoice.count({
    where: { status: "UNPAID", organizationId: session.user.activeOrganizationId! },
  });
  return { count };
}
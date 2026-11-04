import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

export async function generateContractNumber(
  organizationId: string,
  tx: Prisma.TransactionClient,
): Promise<string> {
  const today = new Date();
  const yearMonth = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `SPK-${yearMonth}-`;

  // Serialize concurrent creates within the same org+month: a unique violation inside the
  // interactive transaction would abort it ("current transaction is aborted"), so an
  // in-handler retry cannot recover — the advisory lock prevents the clash instead.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"contract:" + organizationId + yearMonth}))`;

  const latest = await tx.project.findFirst({
    where: {
      contractNumber: { startsWith: prefix },
      organizationId,
    },
    orderBy: { contractNumber: "desc" },
  });

  let nextSequence = 1;
  if (latest?.contractNumber) {
    const seq = parseInt(latest.contractNumber.split("-")[2], 10);
    if (!isNaN(seq)) nextSequence = seq + 1;
  }

  return `${prefix}${String(nextSequence).padStart(4, "0")}`;
}

export async function generateInvoiceNumber(organizationId: string): Promise<string> {
  const today = new Date();
  const yearMonth = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `INV-${yearMonth}-`;

  const latestInvoice = await prisma.invoice.findFirst({
    where: {
      invoiceNumber: { startsWith: prefix },
      organizationId,
    },
    orderBy: { invoiceNumber: "desc" },
  });

  let nextSequence = 1;
  if (latestInvoice && latestInvoice.invoiceNumber) {
    const parts = latestInvoice.invoiceNumber.split("-");
    if (parts.length === 3) {
      const seq = parseInt(parts[2], 10);
      if (!isNaN(seq)) {
        nextSequence = seq + 1;
      }
    }
  }

  const paddedSequence = String(nextSequence).padStart(4, "0");
  return `${prefix}${paddedSequence}`;
}

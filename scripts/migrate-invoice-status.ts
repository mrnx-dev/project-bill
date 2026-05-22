// MIG-1: Invoice status normalization
// Normalize lowercase "unpaid"/"paid" to "UNPAID"/"PAID"
// Idempotent — safe to re-run

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrate() {
  console.log("[MIGRATE] Normalizing invoice status to uppercase...");

  const [unpaidRes, paidRes] = await Promise.all([
    prisma.invoice.updateMany({
      where: { status: { equals: "unpaid", mode: "insensitive" } },
      data: { status: "UNPAID" },
    }),
    prisma.invoice.updateMany({
      where: { status: "paid" },
      data: { status: "PAID" },
    }),
  ]);
  console.log(`  → ${unpaidRes.count} unpaid→UNPAID, ${paidRes.count} paid→PAID`);

  const remaining = await prisma.invoice.count({
    where: { status: { notIn: ["UNPAID", "PAID", "DRAFT", "VOID"] } },
  });
  if (remaining > 0) {
    await prisma.invoice.updateMany({
      where: { status: { notIn: ["UNPAID", "PAID", "DRAFT", "VOID"] } },
      data: { status: "UNPAID" },
    });
    console.log(`  → ${remaining} unrecognized → UNPAID`);
  }

  console.log("[MIGRATE] Done.");
}

migrate()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
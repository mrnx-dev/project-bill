// MIG-1: Invoice status normalization
// Normalize lowercase "unpaid"/"paid" to "UNPAID"/"PAID"
// Idempotent — safe to re-run
// Uses raw pg connection since PrismaClient needs adapter setup

import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  console.log("[MIGRATE] Normalizing invoice status to uppercase...");

  const unpaidRes = await pool.query(
    `UPDATE "Invoice" SET status = 'UNPAID' WHERE LOWER(status) = 'unpaid' AND status != 'UNPAID'`
  );
  console.log(`  → ${unpaidRes.rowCount} unpaid→UNPAID`);

  const paidRes = await pool.query(
    `UPDATE "Invoice" SET status = 'PAID' WHERE status = 'paid'`
  );
  console.log(`  → ${paidRes.rowCount} paid→PAID`);

  const remainingRes = await pool.query(
    `SELECT COUNT(*) as count FROM "Invoice" WHERE status NOT IN ('UNPAID', 'PAID', 'DRAFT', 'VOID')`
  );
  const remaining = parseInt(remainingRes.rows[0].count, 10);
  if (remaining > 0) {
    await pool.query(
      `UPDATE "Invoice" SET status = 'UNPAID' WHERE status NOT IN ('UNPAID', 'PAID', 'DRAFT', 'VOID')`
    );
    console.log(`  → ${remaining} unrecognized → UNPAID`);
  }

  console.log("[MIGRATE] Done.");
}

migrate()
  .then(() => { pool.end(); process.exit(0); })
  .catch((e) => { console.error(e); pool.end(); process.exit(1); });
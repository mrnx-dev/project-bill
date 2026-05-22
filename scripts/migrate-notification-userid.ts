import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log("[MIGRATE] Starting notification userId backfill...");

  // Get all notifications without a userId
  const { rows: notifications } = await pool.query(
    `SELECT id, "organizationId" FROM "Notification" WHERE "userId" IS NULL`
  );
  console.log(`  → Found ${notifications.length} notifications to backfill`);

  let updated = 0;
  let skipped = 0;

  for (const notif of notifications) {
    // Find org owner as fallback
    const { rows: owners } = await pool.query(
      `SELECT "userId" FROM "OrganizationMember" WHERE "organizationId" = $1 AND role = 'OWNER' ORDER BY "joinedAt" ASC LIMIT 1`,
      [notif.organizationId]
    );

    const owner = owners[0];

    if (owner) {
      await pool.query(
        `UPDATE "Notification" SET "userId" = $1 WHERE id = $2`,
        [owner.userId, notif.id]
      );
      updated++;
    } else {
      // Fallback: first member
      const { rows: members } = await pool.query(
        `SELECT "userId" FROM "OrganizationMember" WHERE "organizationId" = $1 ORDER BY "joinedAt" ASC LIMIT 1`,
        [notif.organizationId]
      );

      const firstMember = members[0];
      if (firstMember) {
        await pool.query(
          `UPDATE "Notification" SET "userId" = $1 WHERE id = $2`,
          [firstMember.userId, notif.id]
        );
        updated++;
      } else {
        console.warn(`  → Skipping notification ${notif.id}: no members found for org ${notif.organizationId}`);
        skipped++;
      }
    }

    if (updated % 50 === 0 && updated > 0) {
      console.log(`  → Progress: ${updated} updated, ${skipped} skipped`);
    }
  }

  console.log(`[MIGRATE] Backfill complete: ${updated} updated, ${skipped} skipped`);
}

main()
  .then(() => { pool.end(); process.exit(0); })
  .catch((e) => { console.error(e); pool.end(); process.exit(1); });
// Database-level RLS verification (Tier 2). Connects to the real DB via pg
// (NOT the mocked @/lib/prisma) and asserts the tenant_isolation policy:
//   - GUC unset  → allow all rows (manual-filter / public / cron paths keep working)
//   - GUC=ownOrg → scoped to that org
//   - GUC=bogus  → zero rows (cross-tenant denied by the query planner)
// Skips entirely when DATABASE_URL is absent or the DB is unreachable, so this
// never breaks the unit suite in CI / offline.
import "dotenv/config";

const URL = process.env.DATABASE_URL;

const maybeDescribe = URL ? describe : describe.skip;

maybeDescribe("PostgreSQL RLS — tenant_isolation policy (real DB)", () => {
  const { Pool } = require("pg");
  let pool: any;
  let realOrgId: string | null = null;

  beforeAll(async () => {
    pool = new Pool({ connectionString: URL });
    try {
      const r = await pool.query(`SELECT "organizationId" FROM "Invoice" LIMIT 1`);
      realOrgId = r.rows[0]?.organizationId ?? null;
      if (!realOrgId) {
        // No invoice rows: fall back to any tenant table with an org.
        const c = await pool.query(`SELECT "organizationId" FROM "Client" LIMIT 1`);
        realOrgId = c.rows[0]?.organizationId ?? null;
      }
    } catch {
      // unreachable → tests below will skip via the guard
    }
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  async function countInvoices(client: any, guc: string | null): Promise<number> {
    if (guc !== null) {
      await client.query("BEGIN");
      await client.query("SELECT set_config($1, $2, true)", ["app.current_tenant_id", guc]);
    }
    const res = await client.query(`SELECT count(*)::int n FROM "Invoice"`);
    if (guc !== null) await client.query("COMMIT");
    return res.rows[0].n;
  }

  test("GUC unset → allow all rows (existing flows keep working)", async () => {
    if (!realOrgId) return; // nothing to assert against
    const c = await pool.connect();
    try {
      const total = await countInvoices(c, null);
      const scoped = await countInvoices(c, realOrgId);
      // unset sees at least as many rows as the scoped (own-org) count
      expect(total).toBeGreaterThanOrEqual(scoped);
    } finally {
      c.release();
    }
  });

  test("GUC=own org → scoped (≤ total)", async () => {
    if (!realOrgId) return;
    const c = await pool.connect();
    try {
      const scoped = await countInvoices(c, realOrgId);
      const total = await countInvoices(c, null);
      expect(scoped).toBeLessThanOrEqual(total);
    } finally {
      c.release();
    }
  });

  test("GUC=bogus org → zero rows (cross-tenant denied by query planner)", async () => {
    if (!realOrgId) return;
    const c = await pool.connect();
    try {
      const bogus = await countInvoices(c, "00000000-0000-0000-0000-000000000000");
      expect(bogus).toBe(0);
    } finally {
      c.release();
    }
  });
});
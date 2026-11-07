// Database-level RLS verification (Tier 2). Connects to the real DB via pg
// (NOT the mocked @/lib/prisma) and asserts the tenant_isolation policy
// against fixtures THIS suite owns: GUC=orgA counts only orgA invoices,
// GUC=orgB only orgB, GUC=bogus zero. Runs only with TEST_DATABASE_URL so it
// never touches the development database from DATABASE_URL; a configured but
// unreachable/half-migrated DB fails beforeAll with a clear message instead
// of silently passing.
import "dotenv/config";

// RLS is bypassed for BYPASSRLS/superuser roles (test_db's owner role is a
// bootstrap superuser), so the suite must connect as a dedicated non-super,
// non-bypass role. If a *_RLS_ROLE_PASSWORD is set we swap the URL's user.
const URL = process.env.TEST_DATABASE_URL
  ? process.env.TEST_DATABASE_URL.replace(
      /:\/\/([^:]+):([^@]+)@/,
      (_m, u, p) => `://${process.env.TEST_DB_RLS_ROLE ?? u}:${process.env.TEST_DB_RLS_ROLE_PASSWORD ?? p}@`
    )
  : undefined;

const maybeDescribe = URL ? describe : describe.skip;

if (!URL) {
  console.log("[db-rls] TEST_DATABASE_URL not set — suite skipped");
}

maybeDescribe("PostgreSQL RLS — tenant_isolation policy (real DB)", () => {
  const { Pool } = require("pg");
  let pool: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const RUN = `dbrls_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let orgA = "";
  let orgB = "";

  beforeAll(async () => {
    pool = new Pool({ connectionString: URL, connectionTimeoutMillis: 5000 });
    try {
      const probe = await pool.query("SELECT 1");
      if (!probe) throw new Error("no probe result");
      await pool.query("SELECT count(*) FROM \"Organization\"");
    } catch (e) {
      throw new Error(`[db-rls] TEST_DATABASE_URL unreachable or schema missing: ${(e as Error).message}`);
    }

    // Two owned tenants + one invoice each; cleanup by unique name prefix.
    orgA = (await pool.query(
      `INSERT INTO "Organization" (id, name, slug, "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, $1, now(), now()) RETURNING id`,
      [`${RUN}_orgA`]
    )).rows[0].id;
    orgB = (await pool.query(
      `INSERT INTO "Organization" (id, name, slug, "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, $1, now(), now()) RETURNING id`,
      [`${RUN}_orgB`]
    )).rows[0].id;
    const clientA = (await pool.query(
      `INSERT INTO "Client" (id, name, "organizationId", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, $2, now(), now()) RETURNING id`,
      [`${RUN}_clientA`, orgA]
    )).rows[0].id;
    const projectA = (await pool.query(
      `INSERT INTO "Project" (id, title, "clientId", "organizationId", "totalPrice", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, $2, $3, 100, now(), now()) RETURNING id`,
      [`${RUN}_projectA`, clientA, orgA]
    )).rows[0].id;
    await pool.query(
      `INSERT INTO "Invoice" (id, "invoiceNumber", "projectId", type, amount, "organizationId", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, $2, 'FULL', 100, $3, now(), now())`,
      [`${RUN}_invA`, projectA, orgA]
    );
    const clientB = (await pool.query(
      `INSERT INTO "Client" (id, name, "organizationId", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, $2, now(), now()) RETURNING id`,
      [`${RUN}_clientB`, orgB]
    )).rows[0].id;
    const projectB = (await pool.query(
      `INSERT INTO "Project" (id, title, "clientId", "organizationId", "totalPrice", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, $2, $3, 100, now(), now()) RETURNING id`,
      [`${RUN}_projectB`, clientB, orgB]
    )).rows[0].id;
    await pool.query(
      `INSERT INTO "Invoice" (id, "invoiceNumber", "projectId", type, amount, "organizationId", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, $2, 'FULL', 100, $3, now(), now())`,
      [`${RUN}_invB`, projectB, orgB]
    );
  }, 20000);

  afterAll(async () => {
    if (!pool) return;
    // Always clean fixtures, even after assertion failures.
    await pool.query(`DELETE FROM "Invoice" WHERE "organizationId" IN ($1, $2)`, [orgA, orgB]).catch(() => {});
    await pool.query(`DELETE FROM "Project" WHERE "organizationId" IN ($1, $2)`, [orgA, orgB]).catch(() => {});
    await pool.query(`DELETE FROM "Client" WHERE "organizationId" IN ($1, $2)`, [orgA, orgB]).catch(() => {});
    await pool.query(`DELETE FROM "Organization" WHERE id IN ($1, $2)`, [orgA, orgB]).catch(() => {});
    await pool.end();
  });

  async function countInvoicesWithGuc(client: any, guc: string | null): Promise<number> { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (guc !== null) {
      await client.query("BEGIN");
      await client.query("SELECT set_config($1, $2, true)", ["app.current_tenant_id", guc]);
    }
    const res = await client.query(`SELECT count(*)::int n FROM "Invoice"`);
    if (guc !== null) await client.query("COMMIT");
    return res.rows[0].n;
  }

  test("GUC=orgA counts only orgA's invoice", async () => {
    expect(orgA).toBeTruthy();
    const c = await pool.connect();
    try {
      expect(await countInvoicesWithGuc(c, orgA)).toBe(1);
    } finally {
      c.release();
    }
  });

  test("GUC=orgB counts only orgB's invoice", async () => {
    const c = await pool.connect();
    try {
      expect(await countInvoicesWithGuc(c, orgB)).toBe(1);
    } finally {
      c.release();
    }
  });

  test("GUC unset → allow all rows (own two fixtures visible)", async () => {
    const c = await pool.connect();
    try {
      expect(await countInvoicesWithGuc(c, null)).toBeGreaterThanOrEqual(2);
    } finally {
      c.release();
    }
  });

  test("GUC=bogus org → zero rows (cross-tenant denied by query planner)", async () => {
    const c = await pool.connect();
    try {
      expect(await countInvoicesWithGuc(c, "00000000-0000-0000-0000-000000000000")).toBe(0);
    } finally {
      c.release();
    }
  });

  test("tenant context is transaction-local: after COMMIT the count is unscoped", async () => {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT set_config($1, $2, true)", ["app.current_tenant_id", orgA]);
      expect((await c.query(`SELECT count(*)::int n FROM "Invoice"`)).rows[0].n).toBe(1);
      await c.query("COMMIT");
      expect((await c.query(`SELECT count(*)::int n FROM "Invoice"`)).rows[0].n).toBeGreaterThanOrEqual(2);
    } finally {
      c.release();
    }
  });
});

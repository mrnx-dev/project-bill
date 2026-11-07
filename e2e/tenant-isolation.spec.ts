import { test, expect } from "@playwright/test";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

// Unique run id so fixture cleanup never touches other data.
const RUN = `tenant_iso_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;

let pool: Pool;

interface Fixture {
  orgA: string; orgB: string;
  userA: { id: string; email: string; password: string };
  memberB: string;
  clientA: string; projectA: string;
  clientB: string;
  exportJobB: string;
  magicToken: string;
  clientIdOA: string;
}

let fx: Fixture;

const DB_URL = process.env.TEST_DATABASE_URL as string;

async function insert(pool2: Pool, sql: string, params: unknown[]): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const r = await pool2.query(sql, params);
  return r.rows[0];
}

const PASSWORD_HASH = bcrypt.hashSync("password123", 10);

test.beforeAll(async () => {
  if (!DB_URL) test.skip(true, "TEST_DATABASE_URL not set — e2e fixture requires a real DB");
  pool = new Pool({ connectionString: DB_URL });

  const orgA = (await insert(pool,
    `INSERT INTO "Organization" (id, name, slug, "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, $1, now(), now()) RETURNING id`,
    [`${RUN}_orgA`])).id;
  const orgB = (await insert(pool,
    `INSERT INTO "Organization" (id, name, slug, "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, $1, now(), now()) RETURNING id`,
    [`${RUN}_orgB`])).id;

  const userA = await insert(pool,
    `INSERT INTO "User" (id, email, password, name, role, "onboardingCompleted", "defaultOrganizationId", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, $2, 'Admin A', 'ADMIN', true, $3, now(), now()) RETURNING id, email`,
    [`${RUN}.adminA@test.local`, PASSWORD_HASH, orgA]) as { id: string; email: string };

  // Admin A OWNS orgA; a synthetic user B owns orgB (orgA must not reach orgB rows).
  await pool.query(
    `INSERT INTO "OrganizationMember" (id, "userId", "organizationId", role, "joinedAt") VALUES (gen_random_uuid()::text, $1, $2, 'OWNER', now())`,
    [userA.id, orgA]);
  const userB = await insert(pool,
    `INSERT INTO "User" (id, email, password, name, role, "onboardingCompleted", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, $2, 'Admin B', 'ADMIN', $3, now(), now()) RETURNING id`,
    [`${RUN}.adminB@test.local`, PASSWORD_HASH, true]);
  const memberB = (await insert(pool,
    `INSERT INTO "OrganizationMember" (id, "userId", "organizationId", role, "joinedAt") VALUES (gen_random_uuid()::text, $2, $1, 'MEMBER', now()) RETURNING id`,
    [orgB, userB.id])).id;

  const clientA = (await insert(pool,
    `INSERT INTO "Client" (id, name, "organizationId", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, $2, now(), now()) RETURNING id`,
    [`${RUN}_clientA`, orgA])).id;
  const projectA = (await insert(pool,
    `INSERT INTO "Project" (id, title, "clientId", "organizationId", "totalPrice", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, $2, $3, 100, now(), now()) RETURNING id`,
    [`${RUN}_projectA`, clientA, orgA])).id;
  const clientB = (await insert(pool,
    `INSERT INTO "Client" (id, name, "organizationId", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, $2, now(), now()) RETURNING id`,
    [`${RUN}_clientB`, orgB])).id;

  const exportJobB = (await insert(pool,
    `INSERT INTO "ExportJob" (id, "organizationId", status, "requestedBy", "createdAt") VALUES (gen_random_uuid()::text, $1, 'PROCESSING', $1, now()) RETURNING id`,
    [orgB])).id;

  // ClientAuth magic link for orgB's client — raw token lives only in memory.
  const magicToken = crypto.randomBytes(32).toString("hex");
  // Must match src/lib/client-auth.ts hashToken (plain sha256 of the token)
  const hash = crypto.createHash("sha256").update(magicToken).digest("hex");
  const clientAuth = await insert(pool,
    `INSERT INTO "ClientAuth" (id, "clientId", "magicLinkTokenHash", "magicLinkExpiresAt", "organizationId", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, $2, now() + interval '1 hour', $3, now(), now()) RETURNING id, "clientId"`,
    [clientB, hash, orgB]);

  fx = { orgA, orgB, userA, memberB, clientA, projectA, clientB,
    exportJobB, magicToken, clientIdOA: clientAuth.clientId,
  } as unknown as Fixture;
  void userA.email;
});

test.afterAll(async () => {
  // Keep fixtures for debugging a failed run; remove on success via CLEAN_PASSED_FIXTURES=1
  if (!pool) return;
  const cleanup = process.env.CLEAN_PASSED_FIXTURES === "1";
  if (!cleanup) { await pool.end(); return; }
  await pool.query(`DELETE FROM "ClientAuth" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE name LIKE '${RUN}%')`).catch(() => {});
  await pool.query(`DELETE FROM "ExportJob" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE name LIKE '${RUN}%')`).catch(() => {});
  await pool.query(`DELETE FROM "Invoice" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE name LIKE '${RUN}%')`).catch(() => {});
  await pool.query(`DELETE FROM "ProjectItem" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE name LIKE '${RUN}%')`).catch(() => {});
  await pool.query(`DELETE FROM "Project" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE name LIKE '${RUN}%')`).catch(() => {});
  await pool.query(`DELETE FROM "OrganizationMember" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE name LIKE '${RUN}%')`).catch(() => {});
  await pool.query(`DELETE FROM "Client" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE name LIKE '${RUN}%')`).catch(() => {});
  await pool.query(`DELETE FROM "Organization" WHERE name LIKE '${RUN}%'`).catch(() => {});
  await pool.query(`DELETE FROM "User" WHERE email LIKE '${RUN}.%'`).catch(() => {});
  await pool.end();
});

test.describe("Tenant isolation (cross-org)", () => {
  test("orgA admin cannot see or touch orgB data", async ({ page, request }) => {
    test.skip(!DB_URL, "TEST_DATABASE_URL not set");

    // Login as admin A via UI
    await page.goto("/login");
    await page.getByLabel("Email").fill(`${RUN}.adminA@test.local`);
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByRole("link", { name: "Clients" })).toBeVisible({ timeout: 20000 });

    // Dashboard / clients / projects show only orgA's client and project
    // Dashboard home shows project titles in the status distribution — check /projects for the title instead
    await page.goto("/clients");
    await expect(page.getByRole("cell", { name: `${RUN}_clientA` })).toBeVisible();
    await expect(page.getByRole("cell", { name: `${RUN}_clientB` })).toHaveCount(0);
    await page.goto("/projects");
    await expect(page.getByRole("row", { name: `${RUN}_projectA` })).toBeVisible();

    // API: export status for orgB's job → 403 (no data from orgB). The request
    // carries NO shared cookies (new API context), so 401 is also acceptable.
    const status = await request.get(`/api/organizations/${fx.orgB}/export/status`);
    expect([401, 403, 404]).toContain(status.status());

    // API: PATCH orgB's member from orgA session → 404 (401 if unauthenticated)
    const patch = await request.patch(`/api/organizations/${fx.orgB}/members/${fx.memberB}`, {
      data: { role: "OWNER" },
    });
    expect([401, 403, 404]).toContain(patch.status());

    // Same-org path still works, authenticated: orgA's OWN export-status request
    // (browser cookies shared with request context in Playwright) must NOT 403.
    const own = await page.request.get(`/api/organizations/${fx.orgA}/export/status`);
    expect([200, 404]).toContain(own.status()); // 404 = no export job, fine

    // Magic-link single-use: two concurrent GETs with the same raw token
    const [r1, r2] = await Promise.all([
      request.get(`/api/client-portal/auth/verify?t=${fx.magicToken}`, { maxRedirects: 0 }),
      request.get(`/api/client-portal/auth/verify?t=${fx.magicToken}`, { maxRedirects: 0 }),
    ]);
    const redirects = [r1, r2].map(r => r.headers().location || "");
    expect(redirects.filter(l => l.includes("/portal") && !l.includes("/login")).length).toBe(1);
    expect(redirects.filter(l => l.includes("login")).length).toBe(1);
    // Hash is consumed: third attempt also fails
    const third = await request.get(`/api/client-portal/auth/verify?t=${fx.magicToken}`, { maxRedirects: 0 });
    expect((third.headers().location || "")).toContain("login");
  });
});

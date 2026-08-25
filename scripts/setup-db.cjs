#!/usr/bin/env node
/**
 * One-command database setup for a FRESH ProjectBill DB (run once).
 *
 * Why this exists: PostgreSQL RLS is BYPASSED by superusers, even with FORCE
 * ROW LEVEL SECURITY. So the app MUST connect as a NON-superuser role for the
 * tenant_isolation policy to actually enforce. This script creates that role,
 * makes it own the schema, runs the baseline migration (schema + RLS policies)
 * AS that role, and prints the .env line to use.
 *
 * Usage (from repo root, against a fresh empty DB):
 *   ADMIN_DATABASE_URL="postgresql://<superuser>:<pw>@host:port/projectbill_db" \
 *   npm run setup:db
 *
 * Optional: APP_DB_PASSWORD="..." to choose the app role password (otherwise a
 * strong random one is generated and printed).
 *
 * After it finishes: paste the printed DATABASE_URL line into .env, then
 * `npm run build && npm start` (start runs `prisma migrate deploy` as the app
 * role — a no-op once the baseline is applied — and starts Next).
 */
"use strict";
const { Pool } = require("pg");
const { execSync } = require("child_process");
const crypto = require("crypto");

const ADMIN_URL = process.env.ADMIN_DATABASE_URL;
if (!ADMIN_URL) {
  console.error("✗ Set ADMIN_DATABASE_URL to the superuser URL of the fresh DB, e.g.:");
  console.error("  ADMIN_DATABASE_URL=\"postgresql://postgres:pw@host:5432/projectbill_db\" npm run setup:db");
  process.exit(1);
}
const APP_PASSWORD = process.env.APP_DB_PASSWORD || crypto.randomBytes(18).toString("base64url");
const APP_ROLE = "projectbill_app";

function buildAppUrl(adminUrl, password) {
  const u = new URL(adminUrl);
  u.username = APP_ROLE;
  u.password = password;
  return u.toString();
}

(async () => {
  console.log("→ connecting as admin (superuser)…");
  const admin = new Pool({ connectionString: ADMIN_URL });
  const c = await admin.connect();
  try {
    // 1. Create the non-superuser app role (idempotent). base64url password → safe inline.
    const ex = await c.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [APP_ROLE]);
    if (!ex.rows.length) {
      await c.query(`CREATE ROLE ${APP_ROLE} LOGIN PASSWORD '${APP_PASSWORD}' NOSUPERUSER NOBYPASSRLS`);
      console.log(`✓ created role ${APP_ROLE} (NOSUPERUSER NOBYPASSRLS)`);
    } else if (process.env.APP_DB_PASSWORD) {
      await c.query(`ALTER ROLE ${APP_ROLE} PASSWORD '${APP_PASSWORD}' NOSUPERUSER NOBYPASSRLS`);
      console.log(`~ role ${APP_ROLE} existed; password reset to APP_DB_PASSWORD`);
    } else {
      console.error(`✗ role ${APP_ROLE} already exists. Re-run with APP_DB_PASSWORD set (it will be reset), or DROP ROLE first.`);
      process.exit(1);
    }

    // 2. Make the app role own the public schema (+ CREATE) so migrate deploy,
    //    run as it, creates all tables owned by itself → RLS enforces on it.
    await c.query(`ALTER SCHEMA public OWNER TO ${APP_ROLE}`);
    await c.query(`GRANT USAGE, CREATE ON SCHEMA public TO ${APP_ROLE}`);
    // Transfer ownership of any already-existing tables + grant (idempotent re-run).
    const tabs = await c.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    for (const t of tabs.rows) await c.query(`ALTER TABLE "public"."${t.tablename}" OWNER TO ${APP_ROLE}`);
    await c.query(`GRANT ALL ON ALL TABLES IN SCHEMA public TO ${APP_ROLE}`);
    await c.query(`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${APP_ROLE}`);
    console.log(`✓ ${APP_ROLE} owns schema public + ${tabs.rows.length} table(s)`);
  } finally {
    c.release();
    await admin.end();
  }

  // 3. Run the baseline migration AS the app role (creates schema + RLS policies,
  //    all owned by projectbill_app, RLS enforced on it).
  const appUrl = buildAppUrl(ADMIN_URL, APP_PASSWORD);
  console.log("→ running `prisma migrate deploy` as projectbill_app…");
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: appUrl },
  });

  console.log("\n✅ Setup complete.");
  console.log("Put this line in your .env (replacing the existing DATABASE_URL):");
  console.log(`DATABASE_URL="${appUrl}"`);
  console.log("\nThen:  npm run build && npm start");
  console.log("(start runs `prisma migrate deploy` as projectbill_app — a no-op now — then next start; RLS is enforced because the app role is non-superuser.)");
})().catch((e) => {
  console.error("✗ setup failed:", e.message);
  process.exit(1);
});
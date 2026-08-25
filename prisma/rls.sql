-- Tier 2 — PostgreSQL Row-Level Security for tenant isolation (defense-in-depth).
-- Idempotent: safe to re-run. Applied directly to the dev DB (the repo syncs
-- schema via `prisma db push`, which does NOT manage RLS policies — so this SQL
-- is the source of truth for policies and must be re-run after any `db push`
-- reset until the formal migration-baseline follow-up switches to `migrate deploy`).
--
-- Model: "unset = allow, set = scoped".
--   - When app.current_tenant_id is SET (withTenant routes, via set_config local):
--     the policy restricts rows to the current tenant (USING/WITH CHECK on organizationId).
--   - When UNSET (manual-filter routes, public UUID views, cron, onboarding): the
--     policy allows all rows (IS NULL branch) so existing flows keep working.
-- This is the INCREMENTAL Tier 2: DB enforcement is active on routes that set the
-- GUC; the spec's stricter "unset = deny" default is the end state after every
-- tenant path sets the GUC + a bypass role exists for public/cron (separate work).
--
-- FORCE ROW LEVEL SECURITY: even the table owner is subject to the policy, so the
-- app's connection role cannot bypass RLS by privilege — the GUC must be set to scope.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'AgentConversation','AgentMemory','AuditLog','Client','ClientAuth',
    'ExportJob','Invoice','Notification','OrganizationInvite','OrganizationMember',
    'PaymentMilestone','Project','ProjectItem','RecurringInvoice','Settings','SOWTemplate'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL ' ||
      'USING (NULLIF(current_setting(''app.current_tenant_id'', true), '''') IS NULL ' ||
      '       OR %I = current_setting(''app.current_tenant_id'', true)) ' ||
      'WITH CHECK (NULLIF(current_setting(''app.current_tenant_id'', true), '''') IS NULL ' ||
      '       OR %I = current_setting(''app.current_tenant_id'', true))',
      t, 'organizationId', 'organizationId'
    );
  END LOOP;
END $$;

-- Exempt (no organizationId / global): Organization, User, Subscription,
-- AgentConfig, AgentMessage. No policy needed (RLS not enabled on them).
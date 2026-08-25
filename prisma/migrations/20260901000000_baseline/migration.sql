-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationInvite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "downloadUrl" TEXT,
    "requestedBy" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientAuth" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "magicLinkTokenHash" TEXT,
    "magicLinkExpiresAt" TIMESTAMP(3),
    "magicLinkUsedAt" TIMESTAMP(3),
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientAuth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'to_do',
    "totalPrice" DECIMAL(19,4) NOT NULL,
    "dpAmount" DECIMAL(19,4),
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "language" TEXT NOT NULL DEFAULT 'id',
    "deadline" TIMESTAMP(3),
    "terms" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "termsAcceptedUserAgent" TEXT,
    "termsAcceptedSessionId" TEXT,
    "termsVersionId" INTEGER,
    "taxName" TEXT,
    "taxRate" DECIMAL(19,4),
    "billingMode" TEXT NOT NULL DEFAULT 'SIMPLE',
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DECIMAL(19,4) NOT NULL,
    "quantity" DECIMAL(19,4),
    "rate" DECIMAL(19,4),
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "notes" TEXT,
    "amount" DECIMAL(19,4) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "emailStatus" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" TIMESTAMP(3),
    "paymentLink" TEXT,
    "paymentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "lastReminderAt" TIMESTAMP(3),
    "lateFeeApplied" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMilestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "invoiceId" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "defaultOrganizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL DEFAULT 'ProjectBill',
    "companyAddress" TEXT,
    "companyEmail" TEXT,
    "senderEmail" TEXT,
    "companyLogoUrl" TEXT,
    "companyWhatsApp" TEXT,
    "resendApiKey" TEXT,
    "mayarApiKey" TEXT,
    "mayarWebhookSecret" TEXT,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "organizationId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SOWTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SOWTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "title" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringInvoice" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'monthly',
    "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "linkUrl" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "status" TEXT NOT NULL DEFAULT 'active',
    "mayarCustomerId" TEXT,
    "mayarPaymentId" TEXT,
    "trialStartedAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "emailsSent" INTEGER NOT NULL DEFAULT 0,
    "invoicesCreated" INTEGER NOT NULL DEFAULT 0,
    "paymentLinksUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentConversation" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Conversation',
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "AgentConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "context" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openrouter',
    "model" TEXT NOT NULL DEFAULT 'anthropic/claude-sonnet-4-20250514',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "proactiveMode" BOOLEAN NOT NULL DEFAULT true,
    "locale" TEXT NOT NULL DEFAULT 'id',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "OrganizationMember_organizationId_idx" ON "OrganizationMember"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_userId_organizationId_key" ON "OrganizationMember"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationInvite_token_key" ON "OrganizationInvite"("token");

-- CreateIndex
CREATE INDEX "OrganizationInvite_token_idx" ON "OrganizationInvite"("token");

-- CreateIndex
CREATE INDEX "OrganizationInvite_organizationId_idx" ON "OrganizationInvite"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationInvite_email_idx" ON "OrganizationInvite"("email");

-- CreateIndex
CREATE INDEX "ExportJob_organizationId_idx" ON "ExportJob"("organizationId");

-- CreateIndex
CREATE INDEX "Client_organizationId_idx" ON "Client"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientAuth_clientId_key" ON "ClientAuth"("clientId");

-- CreateIndex
CREATE INDEX "ClientAuth_organizationId_idx" ON "ClientAuth"("organizationId");

-- CreateIndex
CREATE INDEX "ClientAuth_magicLinkTokenHash_idx" ON "ClientAuth"("magicLinkTokenHash");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

-- CreateIndex
CREATE INDEX "Project_organizationId_idx" ON "Project"("organizationId");

-- CreateIndex
CREATE INDEX "ProjectItem_organizationId_idx" ON "ProjectItem"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_projectId_idx" ON "Invoice"("projectId");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_idx" ON "Invoice"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMilestone_invoiceId_key" ON "PaymentMilestone"("invoiceId");

-- CreateIndex
CREATE INDEX "PaymentMilestone_projectId_order_idx" ON "PaymentMilestone"("projectId", "order");

-- CreateIndex
CREATE INDEX "PaymentMilestone_organizationId_idx" ON "PaymentMilestone"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Settings_organizationId_idx" ON "Settings"("organizationId");

-- CreateIndex
CREATE INDEX "SOWTemplate_organizationId_idx" ON "SOWTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "RecurringInvoice_isActive_nextRunAt_idx" ON "RecurringInvoice"("isActive", "nextRunAt");

-- CreateIndex
CREATE INDEX "RecurringInvoice_projectId_idx" ON "RecurringInvoice"("projectId");

-- CreateIndex
CREATE INDEX "RecurringInvoice_organizationId_idx" ON "RecurringInvoice"("organizationId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_organizationId_idx" ON "Notification"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "AgentConversation_userId_createdAt_idx" ON "AgentConversation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentConversation_userId_idx" ON "AgentConversation"("userId");

-- CreateIndex
CREATE INDEX "AgentConversation_organizationId_idx" ON "AgentConversation"("organizationId");

-- CreateIndex
CREATE INDEX "AgentMessage_conversationId_idx" ON "AgentMessage"("conversationId");

-- CreateIndex
CREATE INDEX "AgentMessage_role_idx" ON "AgentMessage"("role");

-- CreateIndex
CREATE INDEX "AgentMemory_userId_idx" ON "AgentMemory"("userId");

-- CreateIndex
CREATE INDEX "AgentMemory_organizationId_idx" ON "AgentMemory"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentMemory_userId_key_key" ON "AgentMemory"("userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "AgentConfig_userId_key" ON "AgentConfig"("userId");

-- CreateIndex
CREATE INDEX "AgentConfig_userId_idx" ON "AgentConfig"("userId");

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationInvite" ADD CONSTRAINT "OrganizationInvite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAuth" ADD CONSTRAINT "ClientAuth_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAuth" ADD CONSTRAINT "ClientAuth_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectItem" ADD CONSTRAINT "ProjectItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectItem" ADD CONSTRAINT "ProjectItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMilestone" ADD CONSTRAINT "PaymentMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMilestone" ADD CONSTRAINT "PaymentMilestone_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMilestone" ADD CONSTRAINT "PaymentMilestone_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SOWTemplate" ADD CONSTRAINT "SOWTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringInvoice" ADD CONSTRAINT "RecurringInvoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringInvoice" ADD CONSTRAINT "RecurringInvoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConversation" ADD CONSTRAINT "AgentConversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AgentConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMemory" ADD CONSTRAINT "AgentMemory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ── Tier 2 RLS: PostgreSQL row-level security (tenant isolation) ──
-- Defense-in-depth under the app-layer interceptor. Model: 'unset = allow,
-- set = scoped' (NULLIF treats the empty-string residual from set_config
-- is_local after COMMIT as unset). FORCE so the non-superuser app role
-- (projectbill_app) is subject. Cross-tenant rows denied when GUC set.
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
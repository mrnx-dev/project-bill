-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "emailStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'id',
ADD COLUMN     "taxName" TEXT,
ADD COLUMN     "taxRate" DECIMAL(19,4),
ADD COLUMN     "terms" TEXT,
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsAcceptedSessionId" TEXT,
ADD COLUMN     "termsAcceptedUserAgent" TEXT,
ADD COLUMN     "termsVersionId" INTEGER;

-- AlterTable
ALTER TABLE "ProjectItem" ADD COLUMN     "quantity" DECIMAL(19,4),
ADD COLUMN     "rate" DECIMAL(19,4);

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "companyWhatsApp" TEXT,
ADD COLUMN     "mayarApiKey" TEXT,
ADD COLUMN     "mayarWebhookSecret" TEXT,
ADD COLUMN     "resendApiKey" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'admin';

-- CreateTable
CREATE TABLE "SOWTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SOWTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "RecurringInvoice_isActive_nextRunAt_idx" ON "RecurringInvoice"("isActive", "nextRunAt");

-- CreateIndex
CREATE INDEX "RecurringInvoice_projectId_idx" ON "RecurringInvoice"("projectId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- AddForeignKey
ALTER TABLE "RecurringInvoice" ADD CONSTRAINT "RecurringInvoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

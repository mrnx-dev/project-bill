-- AlterTable: Add emailProvider to Settings
ALTER TABLE "Settings" ADD COLUMN "emailProvider" TEXT DEFAULT 'resend';

-- CreateTable: EmailProviderConfig
CREATE TABLE "EmailProviderConfig" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "EmailProviderConfig_organizationId_providerId_key_key" ON "EmailProviderConfig" ("organizationId", "providerId", "key");

-- CreateIndex
CREATE INDEX "EmailProviderConfig_organizationId_idx" ON "EmailProviderConfig" ("organizationId");

-- AddForeignKey
ALTER TABLE "EmailProviderConfig" ADD CONSTRAINT "EmailProviderConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

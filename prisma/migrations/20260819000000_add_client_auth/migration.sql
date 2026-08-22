-- The live DB still holds the abandoned older ClientAuth design (columns
-- email/token/tokenExpiresAt, from a prior experiment). Drop it before
-- creating the new schema so this migration is idempotent against that drift.
DROP TABLE IF EXISTS "ClientAuth" CASCADE;

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

-- CreateIndex
CREATE UNIQUE INDEX "ClientAuth_clientId_key" ON "ClientAuth"("clientId");

-- CreateIndex
CREATE INDEX "ClientAuth_organizationId_idx" ON "ClientAuth"("organizationId");

-- CreateIndex
CREATE INDEX "ClientAuth_magicLinkTokenHash_idx" ON "ClientAuth"("magicLinkTokenHash");

-- AddForeignKey
ALTER TABLE "ClientAuth" ADD CONSTRAINT "ClientAuth_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAuth" ADD CONSTRAINT "ClientAuth_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
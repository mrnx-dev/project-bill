-- Step 1: Drop the unique constraint on userId
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_userId_key";

-- Step 2: Drop the foreign key constraint for userId → User
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_userId_fkey";

-- Step 3: Drop the index on userId
DROP INDEX IF EXISTS "Subscription_userId_idx";

-- Step 4: Drop the userId column
ALTER TABLE "Subscription" DROP COLUMN "userId";

-- Step 5: Make organizationId NOT NULL
ALTER TABLE "Subscription" ALTER COLUMN "organizationId" SET NOT NULL;

-- Step 6: Add unique constraint on organizationId
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_key" UNIQUE ("organizationId");

-- Step 7: Add foreign key constraint for organizationId → Organization
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

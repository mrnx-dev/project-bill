-- AlterTable
ALTER TABLE "Project" ADD COLUMN "contractNumber" TEXT;

-- Backfill: SPK-<yyyymm of createdAt>-<sequence within org+month>, oldest first.
-- The IS NULL guard makes this statement safe to re-run: rows that already got a number
-- at creation time must never be renumbered, or a signed document's number would change.
UPDATE "Project" p SET "contractNumber" = sub."num"
FROM (
  SELECT id,
         'SPK-' || to_char("createdAt", 'YYYYMM') || '-' ||
         lpad(row_number() OVER (PARTITION BY "organizationId", to_char("createdAt", 'YYYYMM')
                                 ORDER BY "createdAt", id)::text, 4, '0') AS num
  FROM "Project"
  WHERE "contractNumber" IS NULL
) sub
WHERE p.id = sub.id AND p."contractNumber" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Project_organizationId_contractNumber_key"
  ON "Project"("organizationId", "contractNumber");

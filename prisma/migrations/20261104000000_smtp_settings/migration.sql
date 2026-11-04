-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "smtpHost" TEXT,
ADD COLUMN     "smtpPass" TEXT,
ADD COLUMN     "smtpPort" TEXT,
ADD COLUMN     "smtpUser" TEXT;
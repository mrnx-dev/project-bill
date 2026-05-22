ALTER TABLE "Notification" ADD COLUMN "userId" TEXT;

CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;
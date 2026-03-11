-- AlterTable
ALTER TABLE "admin_logs" ADD COLUMN "userEmail" TEXT,
ADD COLUMN "userName" TEXT;

-- CreateIndex
CREATE INDEX "admin_logs_action_idx" ON "admin_logs"("action");

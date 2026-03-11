-- AlterTable
ALTER TABLE "announcements" ADD COLUMN "dateStart" TIMESTAMP(3),
ADD COLUMN "dateEnd" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "announcements_dateStart_idx" ON "announcements"("dateStart");

-- CreateIndex
CREATE INDEX "announcements_dateEnd_idx" ON "announcements"("dateEnd");

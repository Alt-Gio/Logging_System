-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- AlterTable: make internId nullable on intern_tasks
ALTER TABLE "intern_tasks" ALTER COLUMN "internId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "intern_sessions" (
    "id" TEXT NOT NULL,
    "internId" TEXT NOT NULL,
    "timeIn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timeOut" TIMESTAMP(3),
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "progressNote" TEXT,
    "closedBy" TEXT,
    "hoursLogged" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intern_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "intern_sessions_internId_idx" ON "intern_sessions"("internId");

-- CreateIndex
CREATE INDEX "intern_sessions_status_idx" ON "intern_sessions"("status");

-- CreateIndex
CREATE INDEX "intern_sessions_timeIn_idx" ON "intern_sessions"("timeIn");

-- AddForeignKey
ALTER TABLE "intern_sessions" ADD CONSTRAINT "intern_sessions_internId_fkey" FOREIGN KEY ("internId") REFERENCES "interns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "InternStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'INACTIVE', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "interns" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "school" TEXT NOT NULL,
    "course" TEXT NOT NULL,
    "department" TEXT,
    "supervisor" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "requiredHours" INTEGER NOT NULL DEFAULT 486,
    "status" "InternStatus" NOT NULL DEFAULT 'ACTIVE',
    "email" TEXT,
    "phone" TEXT,
    "photoUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intern_attendance" (
    "id" TEXT NOT NULL,
    "internId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "timeIn" TIMESTAMP(3),
    "timeOut" TIMESTAMP(3),
    "hours" DOUBLE PRECISION,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intern_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intern_tasks" (
    "id" TEXT NOT NULL,
    "internId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intern_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intern_documents" (
    "id" TEXT NOT NULL,
    "internId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intern_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interns_status_idx" ON "interns"("status");
CREATE INDEX "interns_startDate_idx" ON "interns"("startDate");
CREATE INDEX "intern_attendance_internId_idx" ON "intern_attendance"("internId");
CREATE INDEX "intern_attendance_date_idx" ON "intern_attendance"("date");
CREATE INDEX "intern_tasks_internId_idx" ON "intern_tasks"("internId");
CREATE INDEX "intern_tasks_status_idx" ON "intern_tasks"("status");
CREATE INDEX "intern_documents_internId_idx" ON "intern_documents"("internId");

-- AddForeignKey
ALTER TABLE "intern_attendance" ADD CONSTRAINT "intern_attendance_internId_fkey" FOREIGN KEY ("internId") REFERENCES "interns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intern_tasks" ADD CONSTRAINT "intern_tasks_internId_fkey" FOREIGN KEY ("internId") REFERENCES "interns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intern_documents" ADD CONSTRAINT "intern_documents_internId_fkey" FOREIGN KEY ("internId") REFERENCES "interns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

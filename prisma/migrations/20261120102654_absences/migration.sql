-- CreateEnum
CREATE TYPE "DayPeriod" AS ENUM ('MORNING', 'AFTERNOON');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('ABSENT', 'LATE');

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "period" "DayPeriod" NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "justified" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RollCall" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "period" "DayPeriod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RollCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceRecord_schoolId_date_idx" ON "AttendanceRecord"("schoolId", "date");

-- CreateIndex
CREATE INDEX "AttendanceRecord_classGroupId_date_idx" ON "AttendanceRecord"("classGroupId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_studentId_date_period_key" ON "AttendanceRecord"("studentId", "date", "period");

-- CreateIndex
CREATE INDEX "RollCall_schoolId_date_idx" ON "RollCall"("schoolId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RollCall_classGroupId_date_period_key" ON "RollCall"("classGroupId", "date", "period");

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RollCall" ADD CONSTRAINT "RollCall_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

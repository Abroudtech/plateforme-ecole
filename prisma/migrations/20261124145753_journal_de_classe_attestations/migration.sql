-- AlterTable
ALTER TABLE "School" ADD COLUMN     "addressAr" TEXT,
ADD COLUMN     "cityAr" TEXT,
ADD COLUMN     "directorName" TEXT,
ADD COLUMN     "directorNameAr" TEXT;

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "cin" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "hiredOn" DATE;

-- CreateTable
CREATE TABLE "ClassJournal" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "teacherId" TEXT,
    "date" DATE NOT NULL,
    "startMinute" INTEGER,
    "endMinute" INTEGER,
    "week" TEXT,
    "unit" TEXT,
    "unitDay" TEXT,
    "lifeSkills" TEXT[],
    "rows" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassJournal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassJournal_schoolId_date_idx" ON "ClassJournal"("schoolId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ClassJournal_classGroupId_date_authorId_key" ON "ClassJournal"("classGroupId", "date", "authorId");

-- AddForeignKey
ALTER TABLE "ClassJournal" ADD CONSTRAINT "ClassJournal_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassJournal" ADD CONSTRAINT "ClassJournal_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassJournal" ADD CONSTRAINT "ClassJournal_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassJournal" ADD CONSTRAINT "ClassJournal_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

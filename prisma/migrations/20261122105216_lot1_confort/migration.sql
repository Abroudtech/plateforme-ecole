-- AlterTable
ALTER TABLE "School" ADD COLUMN     "showGradesToParents" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AiRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiRequest_schoolId_createdAt_idx" ON "AiRequest"("schoolId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiRequest" ADD CONSTRAINT "AiRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

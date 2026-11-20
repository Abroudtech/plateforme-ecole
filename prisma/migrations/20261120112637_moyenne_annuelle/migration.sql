-- CreateTable
CREATE TABLE "AnnualRule" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "cycle" "Cycle" NOT NULL,
    "termWeights" DOUBLE PRECISION[],
    "passMark" DOUBLE PRECISION NOT NULL DEFAULT 10,

    CONSTRAINT "AnnualRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnnualRule_schoolId_cycle_key" ON "AnnualRule"("schoolId", "cycle");

-- AddForeignKey
ALTER TABLE "AnnualRule" ADD CONSTRAINT "AnnualRule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "EvaluationScheme" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "gradeLevelId" TEXT,
    "trackId" TEXT,
    "classGroupId" TEXT,
    "subjectId" TEXT,

    CONSTRAINT "EvaluationScheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationSchemeItem" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "kind" "AssessmentKind" NOT NULL,
    "weight" DECIMAL(4,2) NOT NULL,

    CONSTRAINT "EvaluationSchemeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvaluationScheme_schoolId_idx" ON "EvaluationScheme"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationSchemeItem_schemeId_kind_key" ON "EvaluationSchemeItem"("schemeId", "kind");

-- AddForeignKey
ALTER TABLE "EvaluationScheme" ADD CONSTRAINT "EvaluationScheme_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationScheme" ADD CONSTRAINT "EvaluationScheme_gradeLevelId_fkey" FOREIGN KEY ("gradeLevelId") REFERENCES "GradeLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationScheme" ADD CONSTRAINT "EvaluationScheme_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationScheme" ADD CONSTRAINT "EvaluationScheme_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationScheme" ADD CONSTRAINT "EvaluationScheme_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationSchemeItem" ADD CONSTRAINT "EvaluationSchemeItem_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "EvaluationScheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

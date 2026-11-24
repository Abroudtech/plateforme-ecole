-- CreateTable
CREATE TABLE "LiveQuiz" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'LOBBY',
    "current" INTEGER NOT NULL DEFAULT 0,
    "questionStartedAt" TIMESTAMP(3),
    "seconds" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "LiveQuiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LivePlayer" (
    "id" TEXT NOT NULL,
    "liveId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LivePlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveAnswer" (
    "id" TEXT NOT NULL,
    "liveId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "question" INTEGER NOT NULL,
    "choice" INTEGER NOT NULL,
    "ms" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveQuiz_classGroupId_phase_idx" ON "LiveQuiz"("classGroupId", "phase");

-- CreateIndex
CREATE UNIQUE INDEX "LivePlayer_liveId_studentId_key" ON "LivePlayer"("liveId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveAnswer_liveId_studentId_question_key" ON "LiveAnswer"("liveId", "studentId", "question");

-- AddForeignKey
ALTER TABLE "LiveQuiz" ADD CONSTRAINT "LiveQuiz_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivePlayer" ADD CONSTRAINT "LivePlayer_liveId_fkey" FOREIGN KEY ("liveId") REFERENCES "LiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivePlayer" ADD CONSTRAINT "LivePlayer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveAnswer" ADD CONSTRAINT "LiveAnswer_liveId_fkey" FOREIGN KEY ("liveId") REFERENCES "LiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveAnswer" ADD CONSTRAINT "LiveAnswer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
